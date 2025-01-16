"use client";
import {
    ActionIcon,
    Box,
    Button,
    Dialog,
    Flex,
    Group,
    Loader,
    Paper,
    Text,
    Textarea,
    useMantineTheme,
} from "@mantine/core";
import { IconCircleCheckFilled, IconSend } from "@tabler/icons-react";
import { FaRegCircleUser, FaRegCircleXmark } from "react-icons/fa6";

import { useEffect, useRef, useState } from "react";
import { useWebsocketContext } from "@/providers/WebsocketProvider";

export enum ChatOperationStatus {
    Working = "working",
    Completed = "completed",
}
const operationLabels = {
    "": "Waiting...",
    planning: "Planning...",
    writing_code: "Writing code...",
    completed: "Completed",
};

interface Message {
    message: string;
    type: "message" | "error";
    operationStatus?: keyof typeof operationLabels;
    fileName?: string;
}

export default function Chat({
    onChatOperationChange,
}: {
    onChatOperationChange: (status: ChatOperationStatus) => void;
}) {
    const currentOperationRef = useRef<ChatOperationStatus>(
        ChatOperationStatus.Completed
    );
    const onWebsocketMessage = (event: MessageEvent) => {
        if (currentOperationRef.current === ChatOperationStatus.Working) return;
        if (typeof event.data !== "string") return;
        const message = JSON.parse(event.data);
        if (message.type === "error") {
            setError(message.data);
        }
    };

    const { addMessageCallback } = useWebsocketContext();

    useEffect(() => {
        addMessageCallback(onWebsocketMessage);
    }, [addMessageCallback]);

    const [error, setError] = useState<string>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [message, setMessage] = useState("");
    const theme = useMantineTheme();

    const sendMessage = async (currentMessage: Message) => {
        onChatOperationChange(ChatOperationStatus.Working);
        currentOperationRef.current = ChatOperationStatus.Working;
        const resp = await fetch("/api/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: currentMessage.message }),
        });
        setMessages((prev) => [
            ...prev,
            {
                message: currentMessage.message,
                operationStatus: "",
                type: currentMessage.type,
                fileName: "",
            },
        ]);

        // consume the stream
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
            if (!reader) break;
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            for (let i = 0; i < parts.length - 1; i++) {
                // trim the 'data: ' prefix
                const data = parts[i].replace("data: ", "");
                const dataJson = JSON.parse(data);
                console.log(dataJson);

                setMessages((prev) =>
                    prev.map((msg, index) => {
                        if (index === prev.length - 1) {
                            console.log(msg.message);
                            return {
                                ...msg,
                                operationStatus: dataJson?.status,
                                fileName: dataJson?.filename,
                            };
                        }
                        return msg;
                    })
                );
                console.log(parts[i]);
            }
            buffer = parts[parts.length - 1];
        }
        console.log("done");

        setError("");

        onChatOperationChange(ChatOperationStatus.Completed);
        currentOperationRef.current = ChatOperationStatus.Completed;
    };

    return (
        <Flex
            gap="md"
            style={{
                width: "100%",
                height: "100%",
                flexDirection: "column",
                background: theme.colors.gray[9],
            }}
        >
            <Flex
                direction="column"
                gap="md"
                style={{
                    overflowY: "auto",
                }}
                p="md"
            >
                {messages.length === 0 && (
                    <Text
                        size="xs"
                        c={theme.colors.gray[7]}
                        style={{ textAlign: "center", padding: "1rem" }}
                    >
                        No messages yet!
                    </Text>
                )}
                {messages.map((msg, index) => (
                    <Paper shadow="xs" p="xl" bg="gray.8" key={index}>
                        <Flex
                            direction="column"
                            justify="space-between"
                            gap="md"
                        >
                            <Flex align="center" gap="xs">
                                {msg.type === "message" && (
                                    <FaRegCircleUser
                                        size={20}
                                        fill={theme.colors.green[4]}
                                        style={{
                                            flexShrink: 0,
                                        }}
                                    />
                                )}

                                {msg.type === "error" && (
                                    <FaRegCircleXmark
                                        size={20}
                                        fill={theme.colors.red[4]}
                                        style={{
                                            flexShrink: 0,
                                        }}
                                    />
                                )}
                                <Box>
                                    <Text
                                        style={{
                                            wordBreak: "break-word",
                                            color:
                                                msg.type === "error"
                                                    ? theme.colors.red[5]
                                                    : undefined,
                                        }}
                                    >
                                        {msg.type === "error"
                                            ? `${msg.message.slice(0, 100)}...`
                                            : msg.message}
                                    </Text>
                                    {msg.operationStatus && (
                                        <Flex align="center" gap="xs">
                                            {msg.operationStatus ===
                                            "completed" ? (
                                                <IconCircleCheckFilled
                                                    style={{
                                                        width: "18px",
                                                        height: "18px",
                                                    }}
                                                />
                                            ) : (
                                                <Loader
                                                    size={12}
                                                    color={theme.colors.blue[6]}
                                                />
                                            )}
                                            <Flex direction="column">
                                                <Text size="xs">
                                                    {
                                                        operationLabels[
                                                            msg.operationStatus
                                                        ]
                                                    }
                                                </Text>
                                                {msg.fileName && (
                                                    <Text
                                                        size="xs"
                                                        c={theme.colors.gray[6]}
                                                        style={{
                                                            wordBreak:
                                                                "break-word",
                                                        }}
                                                    >
                                                        ({msg.fileName})
                                                    </Text>
                                                )}
                                            </Flex>
                                        </Flex>
                                    )}
                                </Box>
                            </Flex>
                        </Flex>
                    </Paper>
                ))}
            </Flex>
            <Flex
                direction="row"
                gap="md"
                mt="auto"
                p="md"
                style={{
                    borderTop: `1px solid ${theme.colors.gray[8]}`,
                }}
                align="center"
            >
                <Textarea
                    style={{
                        width: "100%",
                        borderRadius: 5,
                    }}
                    placeholder="Type your message here"
                    value={message}
                    onChange={(event) => setMessage(event.currentTarget.value)}
                />
                <ActionIcon
                    variant="filled"
                    aria-label="Settings"
                    size="lg"
                    onClick={() => {
                        sendMessage({
                            message,
                            type: "message",
                        });
                        setMessage("");
                    }}
                >
                    <IconSend
                        style={{ width: "70%", height: "70%" }}
                        stroke={1.5}
                    />
                </ActionIcon>
            </Flex>

            <Dialog
                opened={!!error}
                withCloseButton
                onClose={() => {
                    setError("");
                }}
                size="lg"
                radius="md"
                withBorder
            >
                <Flex align="center" gap="sm" mb="md">
                    <FaRegCircleXmark
                        size={20}
                        fill={theme.colors.red[4]}
                        style={{
                            flexShrink: 0,
                        }}
                    />
                    <Text size="sm" fw={500}>
                        There was an error in the last operation
                    </Text>
                </Flex>

                <Text
                    size="sm"
                    c={theme.colors.red[5]}
                    style={{
                        whiteSpace: "pre-wrap",
                        maxHeight: "200px",
                        overflow: "auto",
                        marginBottom: "1rem",
                    }}
                >
                    {error}
                </Text>
                <Group align="flex-end">
                    <Button
                        onClick={() => {
                            sendMessage({
                                message: error || "",
                                type: "error",
                            });
                            setError("");
                        }}
                    >
                        Try to fix
                    </Button>

                    <Button
                        onClick={() => {
                            setError("");
                        }}
                        variant="light"
                    >
                        Ignore
                    </Button>
                </Group>
            </Dialog>
        </Flex>
    );
}
