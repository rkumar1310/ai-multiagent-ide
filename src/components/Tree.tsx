import { useEditorContext } from "@/providers/EditorContextProvider";
import {
    Box,
    Flex,
    Group,
    RenderTreeNodePayload,
    Text,
    Tooltip,
    Tree,
    useTree,
} from "@mantine/core";
import { useEffect } from "react";
import { CiFileOn } from "react-icons/ci";
import { FaNpm, FaRegFolder, FaRegFolderOpen } from "react-icons/fa";
import { MdOutlineCss } from "react-icons/md";
import { SiTypescript } from "react-icons/si";

interface FileIconProps {
    name: string;
    isFolder: boolean;
    expanded: boolean;
}

function FileIcon({ name, isFolder, expanded }: FileIconProps) {
    if (name.endsWith("package.json")) {
        return <FaNpm size={14} />;
    }

    if (
        name.endsWith(".ts") ||
        name.endsWith(".tsx") ||
        name.endsWith("tsconfig.json")
    ) {
        return <SiTypescript size={14} />;
    }

    if (name.endsWith(".css")) {
        return <MdOutlineCss size={14} />;
    }

    if (isFolder) {
        return expanded ? (
            <FaRegFolderOpen color="var(--mantine-color-yellow-9)" size={14} />
        ) : (
            <FaRegFolder color="var(--mantine-color-yellow-9)" size={14} />
        );
    }

    return <CiFileOn size={14} />;
}

function Leaf({
    node,
    expanded,
    hasChildren,
    elementProps,
}: RenderTreeNodePayload) {
    const { setSelectedFile, selectedFile } = useEditorContext();

    return (
        <Tooltip label={node.label} color="gray.8" position="right" withArrow>
            <Group
                gap={5}
                {...elementProps}
                onClick={(e: React.MouseEvent) => {
                    // ignore if directory
                    if (!hasChildren) {
                        setSelectedFile(node.value);
                    }
                    elementProps.onClick(e);
                }}
                style={{
                    borderLeft: `2px solid ${
                        selectedFile === node.value
                            ? "var(--mantine-color-blue-6)"
                            : "transparent"
                    }`,
                    backgroundColor:
                        selectedFile === node.value
                            ? "var(--mantine-color-gray-8)"
                            : "transparent",
                }}
            >
                <Flex px="sm" gap="sm" wrap="nowrap" w="100%" align="center">
                    <Box
                        style={{
                            flexShrink: 0,
                            flexGrow: 0,
                        }}
                    >
                        <FileIcon
                            name={node.value}
                            isFolder={hasChildren}
                            expanded={expanded}
                        />
                    </Box>
                    <Text
                        size="sm"
                        truncate="end"
                        fw={selectedFile === node.value ? 700 : 400}
                    >
                        {node.label}
                    </Text>
                </Flex>
            </Group>
        </Tooltip>
    );
}

export default function EditorTree() {
    const { selectedFile, treeData } = useEditorContext();
    const tree = useTree();

    useEffect(() => {
        // collapse all nodes
        tree.collapseAllNodes();
        // take the selected path, break this into subpaths and expand the tree recursively
        // by calling tree.expand(path)
        // note code-server/workspace is the root path
        if (selectedFile) {
            const paths = selectedFile
                .substring("code-server/workspace".length)
                .split("/");
            paths.forEach((path, index) => {
                if (index === 0) {
                    return;
                }

                tree.expand(
                    `code-server/workspace/${paths
                        .slice(1, index + 1)
                        .join("/")}`
                );
            });
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFile, treeData]);

    return (
        <Tree
            data={treeData}
            renderNode={(payload) => <Leaf {...payload} />}
            tree={tree}
            style={{
                width: "100%",
                height: "fit-content",
                overflowX: "hidden",
            }}
        />
    );
}
