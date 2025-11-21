import { LucideIcon } from "lucide-react";

interface PlaceholderViewProps {
    title: string;
    icon: LucideIcon;
    description: string;
}

export function PlaceholderView({ title, icon: Icon, description }: PlaceholderViewProps) {
    return (
        <div className="flex flex-col h-full items-center justify-center bg-background text-foreground p-6">
            <div className="bg-muted p-6 rounded-full mb-6">
                <Icon className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <p className="text-muted-foreground text-center max-w-md">
                {description}
            </p>
            <div className="mt-8 px-4 py-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 rounded text-sm">
                Work in Progress
            </div>
        </div>
    );
}
