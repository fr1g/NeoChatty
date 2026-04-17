import { useContext, useEffect, useState } from "react";
import { ArrowLeftIcon } from "tdesign-icons-react";
import { ReusableFuncs } from "../../main";
import NavList, { type NavListItem } from "../../comps/NavList";
export default function Settings({ navGoBack }: {
    navGoBack: Function;
}) {
    const reuses = useContext(ReusableFuncs);
    const [items, setItems] = useState<NavListItem[]>([]);
    useEffect(() => {
        if (reuses == null)
            return;
        setItems([
            ({ name: "Profile Home", jumper: () => { reuses.goTo("/settings"); } }) as NavListItem,
            ({ name: "Edit Profile", jumper: () => { reuses.setSettings("profile"); } }) as NavListItem,
            ({ name: "Privacy Settings", jumper: () => { reuses.setSettings("privacy"); } }) as NavListItem,
            ({ name: "General Settings", jumper: () => { reuses.setSettings("general"); } }) as NavListItem,
            ({ name: "About", jumper: () => { reuses.setSettings("about"); } }) as NavListItem,
        ]);
    }, [reuses]);
    return <div className="space-y-1.5">
        <div className="hidden sm:flex gap-3 items-center block-shadow border-button" onClick={() => navGoBack()}>
            <ArrowLeftIcon className="block ml-1" />
            <p>Back</p>
        </div>
        <h3 className="text-xl font-semibold my-1">Settings</h3>
        <p className="text-sm text-slate-500">Profile, privacy, security, and general settings are all here.</p>
        <NavList items={items} />
    </div>;
}
