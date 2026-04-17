import type { ReactNode } from "react";
import type { NavListItem } from "./NavList";
import ClickableAvatar from "./ClickableAvatar";
export interface AvataredListItemInfo {
    avatar: string;
    title: string;
    text: string;
    additionalElement?: ReactNode;
}
export const AvataredNavListItemFactory = (original: NavListItem, text?: string, avatar?: string): NavListItem => {
    return { ...original, customNode: <AvataredListItem info={{ avatar: avatar ?? '', title: original.name, text: text ?? '-', additionalElement: original.customNode }}/> };
};
export default function AvataredListItem({ info = { avatar: "", title: "Item", text: "lorem ipsulm dolor sit amet" } }: {
    info?: AvataredListItemInfo;
}) {
    return <div className="w-full h-full p-1.5 px-2 flex flex-row gap-1.5 relative items-center ">
        <ClickableAvatar url={info.avatar}/>
        <div className="grid grid-cols-1 ">
            <h5 className="real-nowrap font-semibold text-lg max-w-50? max-w-[66vw]">{info.title}</h5>
            <p className="real-nowrap text-base/5 -translate-y-1 max-w-50? max-w-[66vw]">{info.text}</p>
        </div>
        {info.additionalElement && info.additionalElement}
    </div>;
}
