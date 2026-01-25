import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const resetPasswordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
    const [, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(false);

    // Extract token from URL manually since wouter doesn't parse query params automatically in all versions/setups easily
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("token");

    const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
        onSuccess: () => {
            toast.success("Password reset successfully", {
                description: "You can now log in with your new password.",
            });
            setIsLoading(false);
            setLocation("/login");
        },
        onError: (error) => {
            toast.error("Reset failed", {
                description: error.message || "Invalid or expired token.",
            });
            setIsLoading(false);
        },
    });

    const form = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    function onSubmit(data: ResetPasswordFormValues) {
        if (!token) {
            toast.error("Missing reset token");
            return;
        }
        setIsLoading(true);
        resetPasswordMutation.mutate({
            token,
            newPassword: data.password,
        });
    }

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-xl text-destructive">Invalid Link</CardTitle>
                        <CardDescription>This password reset link is invalid or missing a token.</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Link href="/forgot-password" className="text-primary hover:underline">
                            Request a new link
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
                    <CardDescription>
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Reset Password
                            </Button>
                        </form>
                    </Form>
                </CardContent>
                <CardFooter className="flex justify-center border-t p-4">
                    <Link href="/login" className="flex items-center text-sm text-muted-foreground hover:text-primary">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
