"use client";
import React from 'react';
import SettingsContent from '@/app/dashboard/settings/SettingsContent';

export default function DemoSettingsPage() {
    return <SettingsContent isDemo={true} basePath="/demo/dashboard" />;
}
