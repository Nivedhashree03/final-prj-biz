/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "var(--primary)",
                secondary: "var(--secondary)",
                accent: "var(--accent)",
                "bg-deep": "var(--bg-deep)",
                "text-muted": "var(--text-muted)",
            },
            fontFamily: {
                heading: "var(--font-heading)",
                body: "var(--font-body)",
            },
        },
    },
    plugins: [],
}
