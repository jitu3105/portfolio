docker container rm -f portfolio-frontend &&
docker run -d --name portfolio-frontend -v /home/jaggyjalaj/Documents/portfolio/build/static:/usr/share/nginx/html -p 8080:80 -e CHOKIDAR_USEPOLLING=true portfolio-frontend &&
yarn watch