import { useState, useEffect } from "react";
import { type User } from "chatty-sdk";
import { inputClass } from "../pages/covers/Auth";
import { friends as friendsApi } from "../api/index";

export default function AddByAddCode() {
    const [myCode, setMyCode] = useState<number | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(30);
    const [searchingCode, setSearchingCode] = useState('');
    const [searchResult, setSearchResult] = useState<(User & { expireAt: number }) | null>(null);
    const [searchResultCountdown, setSearchResultCountdown] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    function getNewCode() {
        friendsApi.generateAddCode()
            .then(res => {
                if (res.data?.success && res.data?.data) {
                    setMyCode(res.data.data.code);
                    setRemainingSeconds(30);
                }
            })
            .catch(err => {
                console.error('Failed to generate add code:', err);
            });
    }

    useEffect(() => {
        getNewCode();
        setRemainingSeconds(prev => {
            if (prev <= 1) {
                getNewCode();
                return 30;
            }
            return prev - 1;
        });
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    getNewCode();
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [myCode]);

    function handleFindCode() {
        if (!searchingCode) {
            setSearchError('Please enter a code');
            return;
        }
        setIsSearching(true);
        setSearchError('');
        setSearchResult(null);

        friendsApi.verifyAddCode(parseInt(searchingCode))
            .then(res => {
                if (res.data?.success && res.data?.data) {
                    const result = res.data.data as User & { expireAt: number };
                    setSearchResult(result);
                    const secondsRemaining = Math.max(0, Math.ceil((result.expireAt - Date.now()) / 1000));
                    setSearchResultCountdown(secondsRemaining);
                }
            })
            .catch(err => {
                console.error('Failed to verify code:', err);
                setSearchError('Invalid code or code has expired');
            })
            .finally(() => setIsSearching(false));
    }

    useEffect(() => {
        if (!searchResult) return;

        const interval = setInterval(() => {
            setSearchResultCountdown(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [searchResult]);


    function handleSendFriendRequest() {
        if (!searchResult) return;
        setIsSearching(true);

        friendsApi.sendFriendRequestWithCode(parseInt(searchingCode), searchResult.id)
            .then(res => {
                if (res.data?.success) {
                    setSearchResult(null);
                    setSearchingCode('');
                    setSearchError('');
                }
            })
            .catch(err => {
                console.error('Failed to send friend request:', err);
                setSearchError('Failed to send friend request');
            })
            .finally(() => setIsSearching(false));
    }

    return <div>
        <p className="text-xs -translate-y-1.5">
            Add Code is an instant code to allow you to add contact face to face while not changing your privacy settings.
            Be aware: DO NOT LEAK or SHARE to OTHERS in case of protecting your privacy!
            <span>Add Code refreshes in 30 seconds and only can be used once.</span>
        </p>

        <h5 className="font-semibold">Your Code</h5>
        <p className="text-sm">The indicator only shows this code's expiration time. If someone used, click the code to refresh manually.</p>
        <div onClick={() => getNewCode()} className="w-full relative my-1 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-300/30 p-1 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="z-10 relative w-full text-center text-2xl font-mono font-semibold bg-slate-50 dark:bg-slate-900 py-3 rounded-lg" id="code-display">
                {myCode?.toString().padStart(8, '0') ?? '--------'}
            </div>
            <div className="z-1 w-full absolute top-0 bottom-0 left-0 right-0">
                {
                    myCode?.toString().padStart(8, '0') &&
                    <div className="bg-blue-400/50 h-full transition-all" style={{ width: `${(remainingSeconds / 30) * 100}%` }} id="back-time-indicator"></div>
                }
            </div>
        </div>
        <p className="text-xs text-center w-full text-slate-600 dark:text-slate-400 mt-1">{remainingSeconds}s remaining</p>


        <h5 className="font-semibold mt-6">Others Code</h5>
        <div>
            <label className="text-sm text-slate-500 mb-1 block">Looking for another one? Input the provided code and confirm if the guy is correct.</label>
            <div className="flex gap-1.5">
                <input
                    type="number"
                    value={searchingCode}
                    onChange={e => setSearchingCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFindCode()}
                    placeholder="Add Code is 8-digit"
                    className={`${inputClass} grow`}
                    disabled={isSearching}
                />
                <button
                    onClick={handleFindCode}
                    disabled={isSearching}
                    className="border-button flex gap-1 px-3! justify-center items-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                    {isSearching ? 'Finding...' : 'Find'}
                </button>
            </div>

            {searchError && (
                <p className="text-sm text-red-500 mt-2">{searchError}</p>
            )}

            {searchResult && (
                <div className="mt-4 p-4 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        {searchResult.avatar_locator && (
                            <img
                                src={searchResult.avatar_locator}
                                alt={searchResult.username}
                                className="w-12 h-12 rounded-full object-cover"
                            />
                        )}
                        <div className="flex-1">
                            <p className="font-semibold text-sm">{searchResult.display_name || searchResult.username}</p>
                            <p className="text-xs text-slate-500">@{searchResult.username}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                {searchResultCountdown > 0 ? `${searchResultCountdown}s` : 'expired'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleSendFriendRequest}
                        disabled={isSearching || searchResultCountdown <= 0}
                        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                    >
                        {isSearching ? 'Sending...' : 'Add Friend'}
                    </button>
                </div>
            )}
        </div>

    </div>
}
