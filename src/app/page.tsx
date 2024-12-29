"use client";
import {
  ActionIcon,
  AppShell,
  Burger,
  Flex,
  Group,
  Paper,
  SegmentedControl,
  Text,
  Textarea,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSend, IconCircleCheckFilled } from "@tabler/icons-react";
import { useState } from "react";
import { Loader } from "@mantine/core";

const operationLabels = {
  "": "Waiting...",
  planning: "Planning...",
  writing_code: "Writing code...",
  completed: "Completed",
};

export default function BasicAppShell() {
  const [opened, { toggle }] = useDisclosure();

  const theme = useMantineTheme();
  const [view, setView] = useState("Code");
  const [message, setMessage] = useState("");
  const [sentMessage, setSentMessage] = useState("Howdy! How can I help you?");
  const [currentFilename, setCurrentFilename] = useState("");
  const [operationStatus, setOperationStatus] =
    useState<keyof typeof operationLabels>("");

  const sendMessage = async () => {
    const resp = await fetch("/api/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    setSentMessage(message);
    setMessage("");
    setOperationStatus("");

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
        setOperationStatus(dataJson.status);
        if (dataJson.filename) {
          setCurrentFilename(dataJson.filename);
        } else {
          setCurrentFilename("");
        }
        console.log(parts[i]);
      }
      buffer = parts[parts.length - 1];
    }
    console.log("done");
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text>AIDevCore Builder</Text>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <Flex
          gap="md"
          style={{
            width: "100%",
            height: "100%",
            flexDirection: "column",
            background: theme.colors.gray[0],
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
            <Paper shadow="xs" p="xl">
              <Flex direction="column" justify="space-between" gap="md">
                <Text>{sentMessage}</Text>
                {operationStatus && (
                  <Flex align="center" gap="xs">
                    {operationStatus === "completed" ? (
                      <IconCircleCheckFilled
                        style={{ width: "18px", height: "18px" }}
                      />
                    ) : (
                      <Loader size={12} color={theme.colors.blue[6]} />
                    )}
                    <Flex direction="column">
                      <Text size="xs">{operationLabels[operationStatus]}</Text>
                      {currentFilename && (
                        <Text size="xs" color={theme.colors.gray[6]}>
                          ({currentFilename})
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </Paper>
          </Flex>
          <Flex
            direction="row"
            gap="md"
            mt="auto"
            p="md"
            style={{
              border: `1px solid ${theme.colors.gray[2]}`,
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
              onClick={() => sendMessage()}
            >
              <IconSend style={{ width: "70%", height: "70%" }} stroke={1.5} />
            </ActionIcon>
          </Flex>
        </Flex>
      </AppShell.Navbar>
      <AppShell.Main>
        <Flex
          style={{
            width: "100%",
            height: "calc(100vh - 100px)",
            background: theme.colors.gray[2],
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
          <Flex style={{ width: "100%", flexGrow: 1 }} justify="center">
            <Paper
              style={{
                width: "90%",
                height: "fit-content",
                borderRadius: "0.75rem",
                overflow: "hidden",
              }}
              shadow="xs"
            >
              <iframe
                style={{
                  width: "100%",
                  height: "calc(100vh - 200px)",
                  flexGrow: 1,
                  border: "none",
                }}
                src={
                  view === "Code"
                    ? "http://0.0.0.0:8080/?folder=/home/coder/project"
                    : "http://localhost:3100"
                }
              />
            </Paper>
          </Flex>
        </Flex>
      </AppShell.Main>
    </AppShell>
  );
}
