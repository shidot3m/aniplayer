use libloading::{Library, Symbol};
use std::ffi::{c_char, c_int, c_ulong, c_void, CStr, CString};
use std::path::Path;
use std::sync::Arc;

pub type MpvHandle = *mut c_void;

type FnMpvCreate = unsafe extern "C" fn() -> MpvHandle;
type FnMpvInitialize = unsafe extern "C" fn(ctx: MpvHandle) -> c_int;
type FnMpvTerminateDestroy = unsafe extern "C" fn(ctx: MpvHandle);
type FnMpvSetOptionString = unsafe extern "C" fn(ctx: MpvHandle, name: *const c_char, data: *const c_char) -> c_int;
type FnMpvSetPropertyString = unsafe extern "C" fn(ctx: MpvHandle, name: *const c_char, data: *const c_char) -> c_int;
type FnMpvGetPropertyString = unsafe extern "C" fn(ctx: MpvHandle, name: *const c_char) -> *mut c_char;
type FnMpvFree = unsafe extern "C" fn(data: *mut c_void);
type FnMpvCommandString = unsafe extern "C" fn(ctx: MpvHandle, args: *const c_char) -> c_int;
type FnMpvClientApiVersion = unsafe extern "C" fn() -> c_ulong;

pub struct MpvFfi {
    _lib: Arc<Library>,
    mpv_create: FnMpvCreate,
    mpv_initialize: FnMpvInitialize,
    mpv_terminate_destroy: FnMpvTerminateDestroy,
    mpv_set_option_string: FnMpvSetOptionString,
    mpv_set_property_string: FnMpvSetPropertyString,
    mpv_get_property_string: FnMpvGetPropertyString,
    mpv_free: FnMpvFree,
    mpv_command_string: FnMpvCommandString,
}

impl MpvFfi {
    pub fn load(dll_path: &Path) -> Result<Self, String> {
        let lib = unsafe { Library::new(dll_path).map_err(|e| format!("Failed to load {}: {}", dll_path.display(), e))? };
        let lib = Arc::new(lib);

        unsafe {
            let mpv_client_api_version: Symbol<FnMpvClientApiVersion> = lib
                .get(b"mpv_client_api_version\0")
                .map_err(|e| format!("Failed to resolve mpv_client_api_version: {}", e))?;
            let _version = (mpv_client_api_version)();

            let mpv_create: Symbol<FnMpvCreate> = lib
                .get(b"mpv_create\0")
                .map_err(|e| format!("Failed to resolve mpv_create: {}", e))?;
            let mpv_initialize: Symbol<FnMpvInitialize> = lib
                .get(b"mpv_initialize\0")
                .map_err(|e| format!("Failed to resolve mpv_initialize: {}", e))?;
            let mpv_terminate_destroy: Symbol<FnMpvTerminateDestroy> = lib
                .get(b"mpv_terminate_destroy\0")
                .map_err(|e| format!("Failed to resolve mpv_terminate_destroy: {}", e))?;
            let mpv_set_option_string: Symbol<FnMpvSetOptionString> = lib
                .get(b"mpv_set_option_string\0")
                .map_err(|e| format!("Failed to resolve mpv_set_option_string: {}", e))?;
            let mpv_set_property_string: Symbol<FnMpvSetPropertyString> = lib
                .get(b"mpv_set_property_string\0")
                .map_err(|e| format!("Failed to resolve mpv_set_property_string: {}", e))?;
            let mpv_get_property_string: Symbol<FnMpvGetPropertyString> = lib
                .get(b"mpv_get_property_string\0")
                .map_err(|e| format!("Failed to resolve mpv_get_property_string: {}", e))?;
            let mpv_free: Symbol<FnMpvFree> = lib
                .get(b"mpv_free\0")
                .map_err(|e| format!("Failed to resolve mpv_free: {}", e))?;
            let mpv_command_string: Symbol<FnMpvCommandString> = lib
                .get(b"mpv_command_string\0")
                .map_err(|e| format!("Failed to resolve mpv_command_string: {}", e))?;

            Ok(Self {
                _lib: lib.clone(),
                mpv_create: *mpv_create,
                mpv_initialize: *mpv_initialize,
                mpv_terminate_destroy: *mpv_terminate_destroy,
                mpv_set_option_string: *mpv_set_option_string,
                mpv_set_property_string: *mpv_set_property_string,
                mpv_get_property_string: *mpv_get_property_string,
                mpv_free: *mpv_free,
                mpv_command_string: *mpv_command_string,
            })
        }
    }

    pub fn create(&self) -> Result<MpvHandle, String> {
        let handle = unsafe { (self.mpv_create)() };
        if handle.is_null() {
            Err("mpv_create returned null pointer".to_string())
        } else {
            Ok(handle)
        }
    }

    pub fn initialize(&self, ctx: MpvHandle) -> Result<(), String> {
        let ret = unsafe { (self.mpv_initialize)(ctx) };
        if ret < 0 {
            Err(format!("mpv_initialize failed with error code: {}", ret))
        } else {
            Ok(())
        }
    }

    pub fn destroy(&self, ctx: MpvHandle) {
        if !ctx.is_null() {
            unsafe { (self.mpv_terminate_destroy)(ctx) };
        }
    }

    pub fn set_option_string(&self, ctx: MpvHandle, name: &str, data: &str) -> Result<(), String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let c_data = CString::new(data).map_err(|e| e.to_string())?;
        let ret = unsafe { (self.mpv_set_option_string)(ctx, c_name.as_ptr(), c_data.as_ptr()) };
        if ret < 0 {
            Err(format!("mpv_set_option_string({}, {}) error: {}", name, data, ret))
        } else {
            Ok(())
        }
    }

    pub fn set_property_string(&self, ctx: MpvHandle, name: &str, data: &str) -> Result<(), String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let c_data = CString::new(data).map_err(|e| e.to_string())?;
        let ret = unsafe { (self.mpv_set_property_string)(ctx, c_name.as_ptr(), c_data.as_ptr()) };
        if ret < 0 {
            Err(format!("mpv_set_property_string({}, {}) error: {}", name, data, ret))
        } else {
            Ok(())
        }
    }

    pub fn get_property_string(&self, ctx: MpvHandle, name: &str) -> Result<Option<String>, String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let ptr = unsafe { (self.mpv_get_property_string)(ctx, c_name.as_ptr()) };
        if ptr.is_null() {
            Ok(None)
        } else {
            let s = unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned();
            unsafe { (self.mpv_free)(ptr as *mut c_void) };
            Ok(Some(s))
        }
    }

    pub fn command_string(&self, ctx: MpvHandle, cmd: &str) -> Result<(), String> {
        let c_cmd = CString::new(cmd).map_err(|e| e.to_string())?;
        let ret = unsafe { (self.mpv_command_string)(ctx, c_cmd.as_ptr()) };
        if ret < 0 {
            Err(format!("mpv_command_string({}) error: {}", cmd, ret))
        } else {
            Ok(())
        }
    }
}
