# Antigravity CLI Statusline Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./SKILL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

[繁體中文](README.zh-TW.md) | English

This repository provides a Skill for setting up and customizing the Antigravity CLI Statusline (Footer), including display items and localization settings. It is designed to work across multiple platforms and handles configuration efficiently.

## Screenshot

### Windows
![Windows Statusline Screenshot](path/to/your/windows_screenshot.png) <!-- TODO: Upload your Windows image and replace this path -->

### macOS
![macOS Statusline Screenshot](path/to/your/macos_screenshot.png) <!-- TODO: Upload your macOS image and replace this path -->

## Features

- **Rich Status Indicators**: Choose from a variety of display items, including:
  - Current AI Model Name
  - Account API Available Quota
  - API Reset Countdown
  - Context Window Usage Percentage
  - Session Token Count
  - CLI RAM Usage
  - Current Git Branch
  - Project Path (Short / Full)
- **Multi-language Support**: Natively supports Traditional Chinese, English, and Japanese. Features a dynamic architecture that allows you to easily add new languages using AI.
- **Global & CLI-Specific Settings**: Dynamically parses and updates `~/.gemini/settings.json`, `~/.gemini/antigravity-cli/settings.json`, and project-level settings.
- **Python-Free Cross-Platform Architecture**: Completely removes Python dependencies. Uses native commands (`ps`, `lsof`) for macOS/Linux. For Windows, it implements a bespoke Silent C# Bridge with `windowsHide` to eliminate terminal flickering, while significantly improving compatibility for environments without Git in PATH and ensuring accurate memory tracking for the `agy.exe` process.
- **Smart Line Wrapping**: Automatically wraps the statusline to a new line if it exceeds the terminal width.
- **Dynamic Visual Color Feedback**: Provides intuitive ANSI color coding, such as a 4-tier warning system (Green/Yellow/Orange/Red) based on API quota or context usage, and unique brand colors automatically applied to different AI model families.

## Prerequisites

- **Node.js**: This skill is implemented in pure Node.js (`.mjs`). Your system must have Node.js installed, and the `node` command must be available in your terminal.
- **Git** *(Optional)*: The statusline reads the Git branch of the current project. If you want this feature to work, it's recommended to have Git installed on your system.

## Getting Started

1. Go to the **[Releases page](../../releases/latest)** of this repository and download the latest release archive (`.zip` or `.tar.gz`).
2. Extract the archive and place the `antigravity-cli-statusline` folder into your `~/.gemini/skills/` directory.
3. When interacting with Antigravity CLI, simply run `/antigravity-cli-statusline` to trigger the skill.

## Add Your Language Translation via AI

You can easily generate a new language translation for this Skill using an AI agent (like Gemini). To ensure even fast models (like Gemini Flash) can process this perfectly, just copy and paste the prompt below.

Replace `[LANG_CODE]` with your target language code (e.g., `ja`), and `[Target Language]` with the language name (e.g., "Japanese"):

````
I want to add a [Target Language] translation version for this Antigravity CLI Skill (Language Code: [LANG_CODE]).

Since this project dynamically handles languages within single files, please DO NOT create new directories. Please follow these explicit steps to modify the existing files:

### 1. Modify `SKILL.md`
- **Find Step 2 (步驟 2)**: Add the `"[Target Language] ([LANG_CODE])"` option to the `options` JSON array.
- **Find Step 4 (步驟 4)**: Add a bullet point explaining the language format for your code (e.g., `* 若為 [LANG_CODE]，請使用[Target Language]說明配上英文識別碼。`).

### 2. Modify `scripts/statusline-quota.mjs`
- **Find the `const i18n = {` dictionary**: Add a new `[LANG_CODE]` object inside it. Translate all 9 status indicators into [Target Language]. Look at the `zh-tw` or `us` examples and keep the ANSI color variables (like `${BOLD}`) exactly the same.
- **Find the `getGitBranch(lang)` function**: Update **all** the hardcoded ternary operators (there are two places) to include the translation for "No VC" in [Target Language].
- **Find the `countdownVal` variable**: Update the hardcoded ternary operator to include the translation for "N/A" or "None" in [Target Language].
````

## Contributing

We welcome contributions! If you have ideas for new features, bug fixes, or improvements, feel free to open an issue or submit a Pull Request. Whether it's adding a new status indicator, improving cross-platform compatibility, or fixing a typo, your help is greatly appreciated.

## Acknowledgements

Special thanks to [60ke/antigravity-statusline](https://github.com/60ke/antigravity-statusline) for the inspiration behind the quota monitoring feature. Their original project paved the way for statusline integrations. Since their implementation was written in Python, which could be challenging to execute consistently across Windows and macOS, this project was rewritten in JavaScript (Node.js) to ensure seamless cross-platform compatibility without relying on external Python dependencies.

## License

This project is licensed under the [MIT License](LICENSE).
