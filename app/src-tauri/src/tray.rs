//! System tray icon with a quick menu and live state (idle / downloading / paused).

use prism_core::manager::Core;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

pub const TRAY_ID: &str = "prism-tray";

// Windows/Linux trays are usually dark: white glyphs. macOS uses template images
// (black + alpha) that the menu bar tints for light/dark automatically.
#[cfg(not(target_os = "macos"))]
static ICON_IDLE: &[u8] = include_bytes!("../icons/tray/tray-idle.png");
#[cfg(not(target_os = "macos"))]
static ICON_ACTIVE: &[u8] = include_bytes!("../icons/tray/tray-downloading.png");
#[cfg(target_os = "macos")]
static ICON_IDLE: &[u8] = include_bytes!("../icons/tray/tray-idle-template.png");
#[cfg(target_os = "macos")]
static ICON_ACTIVE: &[u8] = include_bytes!("../icons/tray/tray-downloading-template.png");

pub struct TrayState {
    pub limiter: CheckMenuItem<Wry>,
}

pub fn create(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let show = MenuItem::with_id(app, "show", "Open Prism", true, None::<&str>)?;
    let add = MenuItem::with_id(app, "add", "Add URL…", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause_all", "Pause all", true, None::<&str>)?;
    let resume = MenuItem::with_id(app, "resume_all", "Resume all", true, None::<&str>)?;
    let limiter_on = app
        .state::<Core>()
        .settings()
        .downloads
        .speed_limiter_enabled;
    let limiter = CheckMenuItem::with_id(
        app,
        "limiter",
        "Speed limiter",
        true,
        limiter_on,
        None::<&str>,
    )?;
    let mini = MenuItem::with_id(app, "mini", "Mini window", true, None::<&str>)?;
    let drop = MenuItem::with_id(app, "dropzone", "Drop zone", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Prism", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &add,
            &sep()?,
            &pause,
            &resume,
            &limiter,
            &sep()?,
            &mini,
            &drop,
            &sep()?,
            &quit,
        ],
    )?;
    app.manage(TrayState {
        limiter: limiter.clone(),
    });

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(ICON_IDLE)?)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("Prism")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let app = app.clone();
            match event.id().as_ref() {
                "show" => crate::windows::show_main(&app),
                "add" => {
                    let _ = crate::windows::open(&app, "addurl", None);
                }
                "pause_all" => app.state::<Core>().pause_all(),
                "resume_all" => app.state::<Core>().resume_all(),
                "limiter" => {
                    let _ = app.state::<Core>().toggle_speed_limiter();
                    refresh(&app);
                }
                "mini" => {
                    let _ = crate::windows::toggle_mini(&app);
                }
                "dropzone" => {
                    let _ = crate::windows::toggle_dropzone(&app);
                }
                "quit" => {
                    tauri::async_runtime::spawn(async move { crate::quit(&app).await });
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::windows::show_main(tray.app_handle());
            }
        })
        .build(app)
}

/// Sync the limiter check mark with settings.
pub fn refresh(app: &AppHandle) {
    let on = app
        .state::<Core>()
        .settings()
        .downloads
        .speed_limiter_enabled;
    if let Some(state) = app.try_state::<TrayState>() {
        let _ = state.limiter.set_checked(on);
    }
}

/// Update icon + tooltip from aggregate progress (called on each progress event).
pub fn update(app: &AppHandle, active: usize, speed: u64, icon_changed: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let tooltip = if active == 0 {
        "Prism — idle".to_string()
    } else {
        format!("Prism — {active} downloading · {}", human_speed(speed))
    };
    let _ = tray.set_tooltip(Some(tooltip));
    if !icon_changed {
        return;
    }
    let bytes = if active == 0 { ICON_IDLE } else { ICON_ACTIVE };
    if let Ok(img) = Image::from_bytes(bytes) {
        let _ = tray.set_icon(Some(img));
        let _ = tray.set_icon_as_template(cfg!(target_os = "macos"));
    }
}

fn human_speed(bps: u64) -> String {
    const UNITS: [&str; 4] = ["B/s", "KB/s", "MB/s", "GB/s"];
    let mut v = bps as f64;
    let mut i = 0;
    while v >= 1024.0 && i < UNITS.len() - 1 {
        v /= 1024.0;
        i += 1;
    }
    if i == 0 {
        format!("{v:.0} {}", UNITS[i])
    } else {
        format!("{v:.1} {}", UNITS[i])
    }
}
