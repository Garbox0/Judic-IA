"use client";
import React from 'react';
import SettingsPage from '@/app/dashboard/settings/page';

export default function DemoSettingsPage() {
    return <SettingsPage isDemo={true} basePath="/demo/dashboard" />;
}
