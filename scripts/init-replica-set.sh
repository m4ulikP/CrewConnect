#!/bin/bash
# Script to initialize MongoDB single-node replica set rs0 inside Docker
echo "Waiting for MongoDB to be healthy..."
until mongosh --eval "db.adminCommand({ ping: 1 })" --quiet; do
  sleep 1
done

echo "Checking replica set rs0 status..."
if mongosh --eval "rs.status().ok" --quiet | grep -q "1"; then
  echo "Replica set rs0 is already healthy."
else
  echo "Initiating replica set rs0 on localhost:27017..."
  mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })'
  echo "Replica set rs0 initialized."
fi
