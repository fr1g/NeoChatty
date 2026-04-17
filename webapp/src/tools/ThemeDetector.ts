import { useEffect, useState } from "react";
function documentElementSwitcher(mode: 'dark' | 'light') {
    document.documentElement.setAttribute("class", mode);
    document.documentElement.setAttribute("dark", mode);
    localStorage.setItem("theme", mode);
}
export class ThemeHelper {
    mode: 'dark' | 'light' = 'light';
    isDark: boolean = false;
    bindedUpdater = () => { };
    sync = (isDark: boolean) => {
        this.isDark = isDark;
        this.mode = isDark ? 'dark' : 'light';
    };
    trigger = () => {
        this.setTheme(!this.isDark, this.bindedUpdater);
    };
    setTheme = (setAsDark: boolean, setDarkMode: (arg0: boolean) => unknown) => {
        this.sync(setAsDark);
        documentElementSwitcher(this.mode);
        localStorage.theme = this.mode;
        setDarkMode(setAsDark);
    };
    constructor(initState: boolean) {
        this.sync(initState);
    }
}
export const useThemeDetector = () => {
    const getCurrentSysTheme = () => {
        const sysTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return (localStorage.getItem("theme")! !== null && localStorage.theme !== undefined) ? localStorage.theme === "dark" : sysTheme;
    };
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        const sysTheme = getCurrentSysTheme();
        documentElementSwitcher(sysTheme ? 'dark' : 'light');
        return sysTheme;
    });
    function updated(v: boolean) {
        setIsDarkTheme(v);
    }
    const mqResponser = (matches: boolean) => {
        documentElementSwitcher(matches ? "dark" : "light");
        updated(matches);
    };
    const matches = (e: MediaQueryListEvent) => {
        mqResponser(e.matches);
    };
    useEffect(() => {
        const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)");
        darkThemeMq.addEventListener("change", matches);
        return () => darkThemeMq.removeEventListener("change", matches);
    }, []);
    let val = (localStorage.getItem("theme")! !== null && localStorage.theme !== undefined)
        ? localStorage.theme === "dark"
        : isDarkTheme;
    return new ThemeHelper(val);
};
