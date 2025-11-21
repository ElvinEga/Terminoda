import { LucideIcon } from "lucide-react";

interface PlaceholderViewProps {
    title: string;
    icon: LucideIcon;
    description: string;
}

export function PlaceholderView({ title, icon: Icon, description }: PlaceholderViewProps) {
    return (
        <div className="flex flex-col h-full items-center justify-center bg-[#f4f5f7] dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 p-6">
            <div className="bg-gray-200 dark:bg-[#2a2b3d] p-6 rounded-full mb-6">
                <Icon className="h-12 w-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{title}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                {description}
            </p>
            <div className="mt-8 px-4 py-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 rounded text-sm">
                Work in Progress
            </div>
        </div>
    );
}
