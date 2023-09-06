docker service rm portfolio-frontend &&
docker build -t portfolio-frontend-image . &&
docker service create --name portfolio-frontend --network myOverlayNetwork portfolio-frontend-image 