import { Box, Flex, Text, useMantineTheme } from "@mantine/core";
import Editor from "@monaco-editor/react";
import EditorTree from "./Tree";
import { useEditorContext } from "@/providers/EditorContextProvider";

export default function CodeEditor() {
    const theme = useMantineTheme();
    const { selectedFileContent } = useEditorContext();

    return (
        <Flex direction="column">
            <Box
                bg="gray.9"
                style={{
                    textAlign: "center",
                    borderBottom: `1px solid ${theme.colors.gray[8]}`,
                }}
                p="8"
            >
                <Text size="xs" c="gray.1">
                    Workspace
                </Text>
            </Box>
            <Flex direction="row" style={{ height: "100%" }}>
                <Box
                    style={{
                        width: "10rem",
                        flexShrink: 0,
                        flexGrow: 0,
                        overflow: "hidden",
                        borderRight: `1px solid ${theme.colors.gray[8]}`,
                        height: "70vh",
                        overflowY: "auto",
                    }}
                >
                    <EditorTree />
                </Box>
                <Box
                    style={{
                        flexGrow: 1,
                    }}
                >
                    {!selectedFileContent ? (
                        <Flex
                            justify="center"
                            align="center"
                            style={{
                                height: "70vh",
                            }}
                        >
                            <Text size="xl" c="gray.7" fw={700}>
                                No file selected
                            </Text>
                        </Flex>
                    ) : (
                        <Editor
                            width="100%"
                            height="70vh"
                            value={selectedFileContent}
                            options={{
                                lineNumbers: "off",
                                minimap: { enabled: false },
                                padding: { top: 20, bottom: 20 },
                                wordWrap: "on",
                                scrollBeyondLastLine: false,
                            }}
                            theme="vs-dark"
                        />
                    )}
                </Box>
            </Flex>
        </Flex>
    );
}
