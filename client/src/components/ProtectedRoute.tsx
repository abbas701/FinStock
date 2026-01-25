
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import React from "react";
import { Redirect } from "wouter";

export function ProtectedRoute({
    component: Component,
}: {
    component: React.ComponentType<any>;
}) {
    const { data: user, isLoading } = trpc.auth.me.useQuery();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Redirect to="/signup" />;
    }

    return <Component />;
}
