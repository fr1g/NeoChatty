export default function ClickableAvatar({ className = '', url = '', onClick }: {
    className?: string;
    url?: string;
    onClick?: Function;
}) {
    function clickEventHandler(e: any) {
        if (onClick)
            return onClick(e);
    }
    return <div onClick={clickEventHandler} style={{ backgroundImage: url == '' ? '' : `url(${url})` }} className={`${className} rounded-full block-shadow aspect-square bg-no-repeat bg-cover bg-center shrink-0 size-10 sm:w-8 sm:h-8 bg-linear-to-br from-rose-100 via-[#fecaca] to-yellow-300`}></div>;
}
