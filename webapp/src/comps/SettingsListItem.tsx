import type { ReactNode } from "react";
export default function SettingsListItem({ left, right }: {
    left: ReactNode;
    right?: ReactNode;
}) {
    return <div className="flex place-content-between text-xl p-2.5">
        <div>{left}</div>
        {right && <div className="grid items-center">{right}</div>}
    </div>;
}
