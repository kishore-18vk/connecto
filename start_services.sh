#!/bin/bash

# Simple script to manage the PostgreSQL and Redis Docker containers

COMMAND=$1

case "$COMMAND" in
  start)
    echo "Starting PostgreSQL and Redis containers..."
    docker start postgres-chatapp redis-chatapp
    ;;
  stop)
    echo "Stopping PostgreSQL and Redis containers..."
    docker stop postgres-chatapp redis-chatapp
    ;;
  status)
    echo "Container status:"
    docker ps -a --filter name="postgres-chatapp|redis-chatapp"
    ;;
  *)
    echo "Usage: ./start_services.sh [start|stop|status]"
    exit 1
    ;;
esac
