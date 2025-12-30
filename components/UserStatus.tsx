/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useAuth, useAppControls } from './uiUtils';
import { LogoutIcon } from './icons';
import { cn } from '../lib/utils';

const UserStatus: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { t, credits, maxCredits, userRole } = useAppControls();

    if (!currentUser) return null;

    const isVip = userRole === 'vip';

    return (
        <button 
            onClick={logout}
            className="group flex items-center gap-2 rounded-full bg-black/30 pl-4 pr-3 py-1.5 text-sm text-neutral-200 backdrop-blur-sm border border-white/10 hover:bg-red-500/80 hover:border-red-500/90 transition-all duration-200"
            aria-label={t('userStatus_logout', currentUser)}
            title="Đăng xuất"
        >
            <div className="flex flex-col items-start leading-tight mr-1">
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-yellow-400">{currentUser}</span>
                    <span className={cn(
                        "text-[9px] uppercase font-bold px-1.5 py-0 rounded",
                        isVip ? "bg-gradient-to-r from-yellow-600 to-yellow-400 text-black" : "bg-neutral-600 text-white"
                    )}>
                        {isVip ? 'VIP' : 'Normal'}
                    </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    Còn {credits} / {maxCredits} lượt
                </span>
            </div>
            <LogoutIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
        </button>
    );
};

export default UserStatus;