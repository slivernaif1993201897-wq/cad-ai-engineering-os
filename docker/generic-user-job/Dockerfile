FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends gmsh calculix-ccx python3-meshio python3-numpy coreutils \
  && rm -rf /var/lib/apt/lists/*
RUN useradd --uid 65534 --no-create-home --shell /usr/sbin/nologin sandbox
COPY entrypoint.py /opt/cad-ai/entrypoint.py
USER 65534:65534
WORKDIR /work
ENTRYPOINT ["/usr/bin/python3", "/opt/cad-ai/entrypoint.py"]
