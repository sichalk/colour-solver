# Colour → Transparent-on-White Solver

A beautiful React webapp that solves for transparent foreground colors to achieve target colors when composited over white backgrounds. This tool is perfect for designers and developers working with alpha transparency in web design.

## Features

- 🎨 **Interactive color picker** - Choose your target color visually or by hex value
- 🔄 **Real-time calculations** - See the transparent solution update as you adjust parameters
- 📱 **Responsive design** - Works perfectly on desktop and mobile devices
- 🌓 **Light/Dark mode previews** - See how your transparent color looks on different backgrounds
- 🔢 **Precise alpha control** - Fine-tune transparency with minimum feasible limits
- 📊 **Visual feedback** - Checkerboard patterns show transparency effects
- 🧮 **Mathematical accuracy** - Uses proper alpha compositing formulas

## How it works

The tool solves the alpha compositing equation:
```
Target = α × Foreground + (1-α) × White
```

Rearranging to solve for the foreground:
```
Foreground = (Target - (1-α) × White) / α
```

This ensures that when you apply the calculated transparent foreground over a white background, you get exactly the target color you wanted.

## Quick Start

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation & Setup

1. **Clone or download the project**
   ```bash
   cd ColourTransparency
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - The app will automatically open at `http://localhost:3000`
   - If it doesn't open automatically, navigate to the URL manually

### Production Build

To create an optimized production build:

```bash
npm run build
npm run preview
```

## Usage

1. **Set your target color:**
   - Use the color picker to visually select a color
   - Or type a hex value directly (e.g., `#D3E9FF`)

2. **Adjust the alpha (transparency):**
   - Drag the slider to set the desired transparency level
   - The tool automatically enforces minimum feasible alpha values
   - Values below the minimum would result in impossible RGB values

3. **Get your solution:**
   - The tool displays the exact RGB values and CSS code
   - Copy the `rgba()` CSS value for use in your projects

4. **Preview the results:**
   - See side-by-side comparisons of target vs. computed colors
   - View how the transparent color looks on light and dark backgrounds
   - The checkerboard pattern on the right side shows the transparency effect

## Technical Details

- **Framework:** React 18 with Vite for fast development
- **Styling:** Tailwind CSS for modern, responsive design
- **Math:** Implements standard alpha compositing in sRGB color space
- **Performance:** Uses React hooks for optimal re-rendering

## Use Cases

- **Web Design:** Creating consistent transparent overlays
- **UI Components:** Designing glassmorphism effects
- **Brand Colors:** Maintaining color consistency across different backgrounds
- **Accessibility:** Ensuring sufficient contrast with transparent elements

## Browser Support

Works in all modern browsers that support:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- HTML5 color input type

## Development

### Project Structure
```
ColourTransparency/
├── src/
│   ├── AlphaOnWhiteTool.jsx  # Main React component
│   ├── main.jsx              # App entry point
│   └── index.css             # Tailwind CSS imports
├── index.html                # HTML template
├── package.json              # Dependencies and scripts
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind configuration
└── README.md                # This file
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Create production build
- `npm run preview` - Preview production build locally

## Contributing

Feel free to open issues or submit pull requests for improvements!

## License

This project is open source and available under the MIT License.
