import { ModeDarkIcon, ModeLightIcon } from "tdesign-icons-react";
import type { ThemeHelper } from "../tools/ThemeDetector";
export default function ColorModeSwitch({ mgr, labelClassName, className }: {
    mgr: ThemeHelper;
    labelClassName?: string;
    className?: string;
}) {
    return <div className={`${className} . items-center ${labelClassName ? 'flex flex-row' : 'grid'}`} onClick={mgr.trigger}>
        {mgr.isDark ?
            <ModeDarkIcon size={'large'} className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2}/> :
            <ModeLightIcon size={'large'} className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2}/>}
        <div className={`${labelClassName ?? 'hidden'}  translate-y-0.5 grow px-px`}>
            {mgr.isDark ? "Dark" : "Light"}
        </div>
    </div>;
}
