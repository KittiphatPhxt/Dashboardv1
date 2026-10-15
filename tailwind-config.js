tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Prompt', 'Outfit', 'Inter', 'sans-serif'],
                display: ['Prompt', 'Outfit', 'sans-serif']
            },
            colors: {
                sky: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49'
                },
                navy: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#0c4a6e',
                    900: '#082f49'
                },
                accent: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    500: '#0284c7',
                    600: '#0369a1'
                }
            },
            boxShadow: {
                'soft': '0 8px 30px -4px rgba(186, 230, 253, 0.45), 0 4px 12px -2px rgba(14, 165, 233, 0.05)',
                'card': '0 10px 30px -5px rgba(186, 230, 253, 0.45), 0 4px 12px -2px rgba(14, 165, 233, 0.05)',
                'glow': '0 0 20px rgba(56, 189, 248, 0.35)'
            }
        }
    }
};
