import { Description, Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';
export class DialogInfo {
    approveCall: Function;
    approveOpt?: string;
    content: string;
    title: string;
    danger?: 'approve' | 'cancel';
    constructor(content: string, title: string, approveCall: Function, approveOpt?: string, danger?: 'approve' | 'cancel') {
        this.approveCall = approveCall;
        this.approveOpt = approveOpt;
        this.content = content;
        this.title = title;
        this.danger = danger;
    }
}
export default function Modal({ children, activated = false, info, shut }: {
    children?: ReactNode;
    activated: boolean;
    info: DialogInfo;
    shut: Function;
}) {
    function x() {
        try {
            document.getElementById('MODAL___')?.classList.replace('fadein', 'fadeau');
        }
        catch (error) {
        }
        setTimeout(() => {
            shut();
        }, 499);
    }
    function continueOpt() {
        info.approveCall();
        x();
    }
    return <Dialog open={activated} onClose={() => x()} className="relative z-50 init fadein" id="MODAL___">
        <div className="fixed inset-0 flex w-screen items-center justify-center init p-3" id='MODAL_DIALOG'>
            <DialogPanel className="max-w-lg min-w-60 space-y-1.5 sm:space-y-3 shadow-lg init interactive border-2 bg-slate-300/90! dark:bg-slate-800/90! backdrop-blur-3xl p-3 rounded-lg">
                <DialogTitle className="font-bold text-xl ">{info.title}</DialogTitle>

                {children ?? <Description>{info.content}</Description>}
                <div className="flex flex-row-reverse gap-4 mt-3.5">
                    <button className={`border-button px-1.5! py-0.5!  ${info.danger == 'cancel' ? 'bg-red-400/80' : ''}`} id='MODAL___SHUT' onClick={() => x()}>Cancel</button>
                    {info.approveOpt && <button className={`border-button px-1.5! py-0.5!  ${info.danger == 'approve' ? 'bg-red-400/80' : ''}`} onClick={() => continueOpt()}>{info.approveOpt}</button>}
                </div>
            </DialogPanel>
        </div>
    </Dialog>;
}
export function ClickCloseModal() {
    document.getElementById('MODAL___SHUT')!.click();
}
