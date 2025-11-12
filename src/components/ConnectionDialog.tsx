import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { invoke } from "@tauri-apps/api/core"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PlusCircle } from "lucide-react"
import { useState } from "react"

const formSchema = z.object({
  host: z.string().min(1, { message: "Host is required." }),
  port: z.coerce.number().min(1).max(65535).default(22),
  username: z.string().min(1, { message: "Username is required." }),
  password: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>;

interface ConnectionDialogProps {
  onConnect: (sessionId: string) => void;
}

export function ConnectionDialog({ onConnect }: ConnectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      host: "",
      port: 22,
      username: "",
      password: "",
    },
  })

  async function onSubmit(values: FormValues) {
    setConnectError(null);
    console.log("Form submitted, attempting to connect:", values);
    try {
      const newSessionId = await invoke<string>('connect_ssh', { details: values });
      onConnect(newSessionId);
      setOpen(false);
      form.reset();
    } catch (error) {
      const errorMsg = typeof error === 'string' ? error : String(error);
      console.error("Connection failed:", errorMsg);
      setConnectError(errorMsg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> New Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New SSH Connection</DialogTitle>
          <DialogDescription>
            Enter the details of the remote host you want to connect to.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 192.168.1.100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="22" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., root" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Password (optional for now)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {connectError && (
              <p className="text-sm font-medium text-red-500">
                {connectError}
              </p>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting ? "Connecting..." : "Connect"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
