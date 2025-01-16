"use client";
import Editor from "@/components/Editor";
import Chat, { ChatOperationStatus } from "@/components/Chat";
import { EditorContextProvider } from "@/providers/EditorContextProvider";
import WebsocketProvider from "@/providers/WebsocketProvider";
import {
    AppShell,
    Burger,
    Flex,
    Group,
    Paper,
    SegmentedControl,
    Text,
    useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";

export default function BasicAppShell() {
    const [opened, { toggle }] = useDisclosure();

    const theme = useMantineTheme();
    const [view, setView] = useState("Code");
    const frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (view === "Application" && frameRef.current) {
            frameRef.current.src = frameRef.current.src;
        }
    }, [view]);

    return (
        <WebsocketProvider address="ws://localhost:3002">
            <AppShell
                header={{ height: 60 }}
                navbar={{
                    width: 300,
                    breakpoint: "sm",
                    collapsed: { mobile: !opened },
                }}
                padding="md"
            >
                <AppShell.Header>
                    <Group h="100%" px="md" gap="xs">
                        <Burger
                            opened={opened}
                            onClick={toggle}
                            hiddenFrom="sm"
                            size="sm"
                        />
                        <Text>&lt;code\&gt;</Text>
                        <Text
                            fw="bold"
                            style={{
                                background: theme.colors.gray[0],
                                color: theme.colors.gray[9],
                                padding: "0 0.5rem",
                            }}
                        >
                            :Builder
                        </Text>
                    </Group>
                </AppShell.Header>
                <AppShell.Navbar>
                    <Chat
                        onChatOperationChange={(
                            operation: ChatOperationStatus
                        ) => {
                            if (operation === ChatOperationStatus.Working) {
                                setView("Code");
                            } else {
                                setView("Application");
                            }
                        }}
                    />
                </AppShell.Navbar>
                <AppShell.Main
                    style={{
                        background: theme.colors.gray[8],
                    }}
                >
                    <Flex
                        style={{
                            width: "100%",
                            height: "calc(100vh - 100px)",
                        }}
                        direction="column"
                        justify="center"
                        align="center"
                        gap="md"
                        py="md"
                    >
                        <Flex>
                            <SegmentedControl
                                value={view}
                                onChange={setView}
                                data={["Code", "Application"]}
                            />
                        </Flex>
                        <Flex w="100%" justify="center">
                            <Flex
                                style={{
                                    width: "100%",
                                    flexGrow: 1,
                                    flexWrap: "nowrap",
                                    overflow: "hidden",
                                }}
                                justify="center"
                            >
                                <Paper
                                    style={{
                                        width: "100%",
                                        height: "fit-content",
                                        borderRadius: "0.75rem",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                        marginLeft:
                                            view === "Code" ? "100%" : "-100%",
                                        transitionProperty: "all",
                                        transitionTimingFunction:
                                            "cubic-bezier(0.4, 0, 0.2, 1)",
                                        transitionDuration: "150ms",
                                    }}
                                    shadow="xs"
                                >
                                    <EditorContextProvider>
                                        <Editor />
                                    </EditorContextProvider>
                                </Paper>
                                <Paper
                                    style={{
                                        minWidth: "100%",
                                        height: "fit-content",
                                        borderRadius: "0.75rem",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                    }}
                                    shadow="xs"
                                >
                                    <iframe
                                        style={{
                                            minWidth: "100%",
                                            height: "calc(100vh - 200px)",
                                            flexGrow: 1,
                                            border: "none",
                                        }}
                                        ref={frameRef}
                                        src="http://localhost:5003"
                                    />
                                </Paper>
                            </Flex>
                        </Flex>
                    </Flex>
                </AppShell.Main>
            </AppShell>
        </WebsocketProvider>
    );
}
