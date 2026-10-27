use libloading::{Library, Symbol};
use std::ffi::{c_char, c_int, c_ulong, c_void, CStr, CString};
use std::path::Path;
use std::ptr::NonNull;
use std::sync::Arc;

/// Safe owning wrapper over an `mpv_handle` pointer.
///
/// The raw pointer never leaves this type: all FFI helpers accept `&MpvContext`
/// and dereference the handle internally. Dropping the context destroys the
/// mpv client, so every error path frees the native handle.
pub struct MpvContext {
    ffi: Arc<MpvFfi>,
    handle: NonNull<c_void>,
}

// Safe to share across threads per libmpv client API guarantees.
unsafe impl Send for MpvContext {}
unsafe impl Sync for MpvContext {}

impl Drop for MpvContext {
    fn drop(&mut self) {
        unsafe { (self.ffi.mpv_terminate_destroy)(self.handle.as_ptr()) };
    }
}

type FnMpvCreate = unsafe extern "C" fn() -> *mut c_void;
type FnMpvInitialize = unsafe extern "C" fn(ctx: *mut c_void) -> c_int;
type FnMpvTerminateDestroy = unsafe extern "C" fn(ctx: *mut c_void);
type FnMpvSetOptionString =
    unsafe extern "C" fn(ctx: *mut c_void, name: *const c_char, data: *const c_char) -> c_int;
type FnMpvSetPropertyString =
    unsafe extern "C" fn(ctx: *mut c_void, name: *const c_char, data: *const c_char) -> c_int;
type FnMpvGetPropertyString =
    unsafe extern "C" fn(ctx: *mut c_void, name: *const c_char) -> *mut c_char;
type FnMpvFree = unsafe extern "C" fn(data: *mut c_void);
type FnMpvCommandString = unsafe extern "C" fn(ctx: *mut c_void, args: *const c_char) -> c_int;
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
        let lib = unsafe {
            Library::new(dll_path)
                .map_err(|e| format!("Failed to load {}: {}", dll_path.display(), e))?
        };
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
            let mpv_command_string: Symbol<FnMpvCommandString> =
                lib.get(b"mpv_command_string\0")
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

    pub fn create_context(self: &Arc<Self>) -> Result<Arc<MpvContext>, String> {
        let raw = unsafe { (self.mpv_create)() };
        let handle =
            NonNull::new(raw).ok_or_else(|| "mpv_create returned null pointer".to_string())?;
        Ok(Arc::new(MpvContext {
            ffi: self.clone(),
            handle,
        }))
    }

    pub fn initialize(&self, ctx: &MpvContext) -> Result<(), String> {
        let ret = unsafe { (self.mpv_initialize)(ctx.handle.as_ptr()) };
        if ret < 0 {
            Err(format!("mpv_initialize failed with error code: {}", ret))
        } else {
            Ok(())
        }
    }

    pub fn set_option_string(
        &self,
        ctx: &MpvContext,
        name: &str,
        data: &str,
    ) -> Result<(), String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let c_data = CString::new(data).map_err(|e| e.to_string())?;
        let ret = unsafe {
            (self.mpv_set_option_string)(ctx.handle.as_ptr(), c_name.as_ptr(), c_data.as_ptr())
        };
        if ret < 0 {
            Err(format!(
                "mpv_set_option_string({}, {}) error: {}",
                name, data, ret
            ))
        } else {
            Ok(())
        }
    }

    pub fn set_property_string(
        &self,
        ctx: &MpvContext,
        name: &str,
        data: &str,
    ) -> Result<(), String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let c_data = CString::new(data).map_err(|e| e.to_string())?;
        let ret = unsafe {
            (self.mpv_set_property_string)(ctx.handle.as_ptr(), c_name.as_ptr(), c_data.as_ptr())
        };
        if ret < 0 {
            Err(format!(
                "mpv_set_property_string({}, {}) error: {}",
                name, data, ret
            ))
        } else {
            Ok(())
        }
    }

    pub fn get_property_string(
        &self,
        ctx: &MpvContext,
        name: &str,
    ) -> Result<Option<String>, String> {
        let c_name = CString::new(name).map_err(|e| e.to_string())?;
        let ptr = unsafe { (self.mpv_get_property_string)(ctx.handle.as_ptr(), c_name.as_ptr()) };
        if ptr.is_null() {
            Ok(None)
        } else {
            let s = unsafe { CStr::from_ptr(ptr) }
                .to_string_lossy()
                .into_owned();
            unsafe { (self.mpv_free)(ptr as *mut c_void) };
            Ok(Some(s))
        }
    }

    pub fn command_string(&self, ctx: &MpvContext, cmd: &str) -> Result<(), String> {
        let c_cmd = CString::new(cmd).map_err(|e| e.to_string())?;
        let ret = unsafe { (self.mpv_command_string)(ctx.handle.as_ptr(), c_cmd.as_ptr()) };
        if ret < 0 {
            Err(format!("mpv_command_string({}) error: {}", cmd, ret))
        } else {
            Ok(())
        }
    }
}
