import { useContext, useEffect, type ReactNode } from "react";
import { ReusableFuncs } from "../../main";
import { ChevronLeftIcon } from "tdesign-icons-react";
export default function SettingsLayout({ children, title, explain }: {
    children: ReactNode;
    title: string;
    explain?: string;
}) {
    const reuses = useContext(ReusableFuncs);
    useEffect(() => {
        if (reuses) {
        }
    }, [reuses]);
    return <div className="h-full w-full p-1.5 overflow-hidden flex flex-col gap-1">
        <div className="flex gap-3">
            <div onClick={() => reuses?.goHome()} className="border-button grid size-full items-center justify-items-center sm:hidden aspect-square w-fit">
                <ChevronLeftIcon className="block" fillColor='transparent' strokeColor='currentColor' strokeWidth={2}/>
            </div>
            <h1 className="font-semibold text-3xl text-shadow-sm text-shadow-slate-500/20 grow">
                {title}
            </h1>
        </div>
        {explain && <p>{explain}</p>}
        <div className="scrollable++     overflow-x-hidden overflow-y-auto grow">
            {children}
        </div>
    </div>;
}
