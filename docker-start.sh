# This will start a code-server container and expose it at http://127.0.0.1:8080.
# It will also mount your current directory into the container as `/home/coder/project`
# and forward your UID/GID so that all file system operations occur as your user outside
# the container.
#
# Your $HOME/.config is mounted at $HOME/.config within the container to ensure you can
# easily access/modify your code-server config in $HOME/.config/code-server/config.json
# outside the container.
mkdir -p ~/.config
cd code-server
rm -rf workspace
npx npx create-next-app@latest workspace --ts --tailwind --app --turbopack --use-npm --src-dir --yes
# # cd ..
# docker run -it --rm --name code-server -p 127.0.0.1:8080:8080 \
#   -p 127.0.0.1:3100:3000 \
#   -v "$PWD/code-server/.local:/home/coder/.local" \
#   -v "$PWD/code-server/.config:/home/coder/.config" \
#   -v "$PWD/code-server/workspace:/home/coder/project" \
#   -u "$(id -u):$(id -g)" \
#   -e "DOCKER_USER=$USER" \
#   codercom/code-server:latest