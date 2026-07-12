use std::path::Path;

use zed_extension_api::settings::LspSettings;
use zed_extension_api::{self as zed, serde_json, Result};

/// Relative path to the TypeScript SDK inside a worktree's own node_modules.
/// Volar's typescript-language-server plugin needs this to resolve the tsserver
/// that actually understands the project (paths, versions, etc.) rather than
/// bundling its own.
const TYPESCRIPT_TSDK_PATH: &str = "node_modules/typescript/lib";

struct EdgeExtension;

impl EdgeExtension {
    /// Resolve the `edge-language-server` binary.
    ///
    /// Order: user override in settings.json (`lsp.edge-language-server.binary.path`),
    /// then a binary reachable on the worktree's PATH (this includes
    /// `node_modules/.bin`, since Zed prepends it when resolving `which` inside a
    /// worktree). Errors with a message pointing at the fix rather than a bare
    /// "not found", since there is no npm package to auto-install here (the server
    /// ships from this monorepo, unpublished).
    fn server_command(&self, worktree: &zed::Worktree) -> Result<zed::Command> {
        let lsp_settings = LspSettings::for_worktree("edge-language-server", worktree).ok();
        let binary_settings = lsp_settings.and_then(|settings| settings.binary);

        if let Some(path) = binary_settings.as_ref().and_then(|b| b.path.clone()) {
            let args = binary_settings
                .as_ref()
                .and_then(|b| b.arguments.clone())
                .unwrap_or_default();
            return Ok(zed::Command {
                command: path,
                args,
                env: worktree.shell_env(),
            });
        }

        // worktree.which only searches the shell PATH, not node_modules/.bin —
        // probe the conventional bin location directly (read_text_file doubles
        // as an existence check that works over remote worktrees too).
        let bin_rel = "node_modules/.bin/edge-language-server";
        if worktree.read_text_file(bin_rel).is_ok() {
            let bin_abs = Path::new(&worktree.root_path())
                .join(bin_rel)
                .to_string_lossy()
                .to_string();
            return Ok(zed::Command {
                command: bin_abs,
                args: vec![],
                env: worktree.shell_env(),
            });
        }

        if let Some(path) = worktree.which("edge-language-server") {
            return Ok(zed::Command {
                command: path,
                args: vec![],
                env: worktree.shell_env(),
            });
        }

        Err(concat!(
            "edge-language-server not found. Install it in this project ",
            "(e.g. `bun add -D @edge-language-tools/language-server`, or link the ",
            "monorepo package so it lands in node_modules/.bin), or set an explicit ",
            "path via `lsp.edge-language-server.binary.path` in your Zed settings.json."
        )
        .to_string())
    }

    fn typescript_tsdk_path(&self, worktree: &zed::Worktree) -> String {
        let root_path = worktree.root_path();
        Path::new(&root_path)
            .join(TYPESCRIPT_TSDK_PATH)
            .to_string_lossy()
            .to_string()
    }
}

impl zed::Extension for EdgeExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        self.server_command(worktree)
    }

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<Option<serde_json::Value>> {
        Ok(Some(serde_json::json!({
            "typescript": {
                "tsdk": self.typescript_tsdk_path(worktree)
            }
        })))
    }
}

zed::register_extension!(EdgeExtension);
