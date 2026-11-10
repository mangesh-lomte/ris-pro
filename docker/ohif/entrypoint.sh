#!/bin/sh
set -e

# Dynamically construct HTTP Basic Auth header value from environment variables at runtime
if [ -z "$ORTHANC_USERNAME" ] || [ -z "$ORTHANC_PASSWORD" ]; then
  echo "Error: ORTHANC_USERNAME and ORTHANC_PASSWORD environment variables are required." >&2
  exit 1
fi

ORTHANC_BASIC_AUTH="Basic $(printf '%s:%s' "$ORTHANC_USERNAME" "$ORTHANC_PASSWORD" | base64 | tr -d '\r\n')"
export ORTHANC_BASIC_AUTH

# Substitute only the ORTHANC_BASIC_AUTH variable into the template to protect nginx variables
envsubst '${ORTHANC_BASIC_AUTH}' < /usr/src/ohif-nginx.conf.template > /usr/src/default.conf.template

# Hand over execution to the standard OHIF entrypoint
exec /usr/src/entrypoint.sh "$@"
