import { useContext, useState, useEffect } from "react";
import NavList, { type NavListItem } from "../../comps/NavList";
import { ReusableFuncs, type ModalControl } from "../../main";
import SettingsLayout from "./SettingsLayout";
import ColorModeSwitch from "../../comps/ColorModeSwitch";
import SettingsListItem from "../../comps/SettingsListItem";
import { InfoCircleIcon, LogoutIcon, LockOnIcon, ViewListIcon } from "tdesign-icons-react";
import type { DialogInfo } from "../../comps/Modal";
import { useAuth } from "../../context/AuthContext";
export default function GeneralSettings() {
    const reuses = useContext(ReusableFuncs);
    const { logout } = useAuth();
    const [items, setItems] = useState<NavListItem[]>([]);
    useEffect(() => {
        if (reuses)
            setItems([
                ({
                    name: "Color Mode",
                    customNode: <SettingsListItem left={"Dark Mode"} right={<ColorModeSwitch className="block my-auto" mgr={reuses.themeMgr} />} />,
                    jumper: () => {
                        reuses.themeMgr.trigger();
                    }
                }) as NavListItem,
                ({
                    name: "ChangePassword",
                    customNode: <SettingsListItem left={"Change Password"} right={<LockOnIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />,
                    jumper: () => {
                        reuses.goTo("/settings/password");
                    }
                }) as NavListItem,
                ({
                    name: "Blacklist",
                    customNode: <SettingsListItem left={"Manage Blocklist"} right={<ViewListIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />,
                    jumper: () => {
                        reuses.goTo("/settings/blacklist");
                    }
                }) as NavListItem,
                ({
                    name: "Logoff",
                    customNode: <SettingsListItem left={"Sign Out"} right={<LogoutIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />,
                    jumper: () => {
                        reuses.modalUpdate({
                            info: {
                                approveCall: () => { logout(); },
                                approveOpt: "Sign Out",
                                title: "Sign Out",
                                content: "Sign out of this account? You will need to Log In again.",
                                danger: 'approve'
                            } as DialogInfo,
                            showing: true,
                            customChildren: undefined
                        } as ModalControl);
                    }
                }) as NavListItem,
                ({
                    name: "About",
                    customNode: <SettingsListItem left="About" right={<InfoCircleIcon fillColor='transparent' strokeColor='currentColor' strokeWidth={2} />} />,
                    jumper: () => {
                        reuses.modalUpdate({
                            info: {
                                title: "About Chatty",
                                content: "Chatty Web v1.0.0\nBuilt with React + Vite",
                            } as DialogInfo,
                            showing: true,
                        } as ModalControl);
                    }
                }) as NavListItem,
            ]);
    }, [reuses, logout]);
    return <SettingsLayout title="General" explain="Manage app preferences, account security, and personalization.">
        <NavList items={items} tight />
    </SettingsLayout>;
}
