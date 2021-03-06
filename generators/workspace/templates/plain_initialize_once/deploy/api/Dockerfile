FROM python:3.7-buster

LABEL maintainer="contact@caleydo.org"
WORKDIR /phovea

# install dependencies last step such that everything before can be cached
COPY requirements*.txt docker_packages.txt docker_script*.sh _docker_data* ./
RUN (!(test -s docker_packages.txt) || (apt-get update && \
    (cat docker_packages.txt | xargs apt-get install -y))) && \
    (pip install --no-cache-dir -r requirements.txt)
RUN (!(test -s docker_script.sh) || (bash ./docker_script.sh))

COPY ./build/source ./

# Create separate launch file (similar to phovea_server/__main__.py from repository root), because it is not included in build files
RUN printf "from phovea_server import launch\nlaunch.run()\n" > /phovea/launch.py

ENV PHOVEA_ENV=production
ENV PHOVEA_SERVICE=api
ENV PHOVEA_CONFIG_PATH=config.json
CMD python launch.py --env ${PHOVEA_ENV} ${PHOVEA_SERVICE}
EXPOSE 80
