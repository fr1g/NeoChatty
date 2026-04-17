import { useState, type ReactNode } from "react";
export interface NavListItem {
    name: string;
    jumper: Function;
    customNode?: ReactNode;
}
export default function NavList({ items, tight = false, hintBottom = false }: {
    items: NavListItem[];
    tight?: boolean;
    hintBottom?: boolean;
}) {
    const [select, setSelect] = useState<null | NavListItem>(null);
    const doSelect = (func: Function, sel: NavListItem) => {
        setSelect(sel);
        func();
    };
    return <div className="shadow-none  rounded-lg grow? overflow-y-scroll">
        <ul className={` ${tight ? 'use-tight-list' : 'space-y-1 bg-slate-50/15 dark:bg-slate-200/10'} ${hintBottom ? 'mb-36' : ''} sm:pb-0`}>
            {items.map((i: NavListItem, index) => {
                return <li key={`${i.name}-${index}`} onClick={() => doSelect(i.jumper, i)} className={`${i.customNode ? '' : 'p-3'} ${tight ? 'tight-item' : 'rounded-lg'} hover:shadow ${i.name == select?.name ? 'bg-slate-500/30! dark:bg-slate-500/75!' : ''} bg-transparent hover:bg-slate-100/40 dark:hover:bg-slate-400/50 active:bg-slate-500/55 dark:active:bg-slate-500`}>
                    {i.customNode ?? <p>
                        {i.name}
                    </p>}
                </li>;
            })}
            {hintBottom ?
                <li className="relative py-5 block sm:hidden">
                    <div className="w-2/3 h-0.5 mx-auto bg-slate-400"></div>
                    <p className="text-center text-xs/2 opacity-60 absolute top-auto left-0 right-0 bottom-0 -translate-y-1">End</p>
                </li> : <></>}
        </ul>
    </div>;
}
