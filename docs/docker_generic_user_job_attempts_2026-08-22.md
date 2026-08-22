# Docker Generic User-Job Attempt Record

## Attempt 1 — Image Build Failure

GitHub Actions run `32540605147` built the Docker image dependencies but failed because Ubuntu already reserves UID `65534`; the Dockerfile attempted to create that identity again. The failure occurred before a container started, no solver was invoked, and the image was repaired to use the existing unprivileged `nobody` identity directly.

## Attempt 2 — Probe Exit Before Evidence

GitHub Actions run `32540717709` successfully built the repaired image and created a Docker container with the intended `readOnlyRootfs`, `network=none`, `CapDrop=ALL`, `no-new-privileges`, 1 CPU, 512 MiB memory, 256 pids, 64 MiB file-size, read-only input, and tmpfs mounts. The container exited with code `1` during `probe` before emitting a probe report. The initial artifact did not preserve a start-state record; a diagnostic repair was committed.

## Attempt 3 — Start-State Evidence

GitHub Actions run `32540867324` preserved post-start evidence. The container exited with code `1` after process start; Docker inspection confirmed the intended static entrypoint, unprivileged UID/GID `65534`, private cgroup namespace, `docker-default` AppArmor profile, `network=none`, read-only root filesystem, no-new-privileges, dropped capabilities, 512 MiB memory, 1 CPU, 256 pids, and read-only `/input` bind. The probe still did not emit output, indicating an internal tmpfs-permission or exception-reporting defect rather than an observed sandbox escape or solver execution.

All three attempts are retained as internal evidence. None produced a generic solver result, and none changes the production runtime gate.
