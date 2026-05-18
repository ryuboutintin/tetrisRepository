# Project Overview: Web Development Exercises

This directory serves as a workspace for web development exercises and projects. The main project currently implemented is a **Modern Markdown Editor**.

## Key Project: Modern Markdown Editor
A fully functional, browser-based Markdown editor with a focus on clean UI/UX and persistence.

### Main Technologies
- **HTML5**: Structure of the editor and preview panes.
- **CSS3**: Modern styling with CSS variables, featuring a GitHub-inspired **Dark Mode**.
- **JavaScript (Vanilla)**: Core logic for real-time updates and persistence.
- **marked.js**: A high-performance markdown parser used via CDN.

### Architecture
- **Split-Pane Layout**: Utilizes CSS Flexbox for a 50:50 side-by-side editing and previewing experience.
- **Real-Time Preview**: Listens for `input` events on the textarea to parse and render markdown immediately.
- **Persistence**: Automatically saves content to the browser's `localStorage` with a 500ms debounce to prevent excessive writes.

## Building and Running
As this is a client-side web project, it does not require a complex build process.

### Commands
- **Run Locally**: Use a simple HTTP server to serve the files.
  ```bash
  python3 -m http.server 8000 --directory day01/markdown-editor/
  ```
- **Access**: Open `http://localhost:8000` in any modern web browser.

## Development Conventions
- **Separation of Concerns**: Always keep HTML, CSS, and JavaScript in separate files.
- **Theme Consistency**: Use CSS variables (defined in `:root`) for colors and spacing to ensure theme consistency (e.g., Dark Mode).
- **UX Feedback**: Provide visual indicators for background tasks like "Saving...".
- **External Libraries**: Prefer reliable CDNs for lightweight libraries like `marked.js`.

## Directory Structure
- `day01/markdown-editor/`: Contains the source code for the Markdown Editor.
  - `index.html`: The entry point.
  - `style.css`: The look and feel.
  - `script.js`: The interactivity.
- `day01/test`: A placeholder/experimental file.
