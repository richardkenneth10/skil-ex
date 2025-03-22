import { Injectable } from '@nestjs/common';

@Injectable()
export class RecordingService {
  private MIN_PORT = 20000;
  private MAX_PORT = 30000;
  private TIMEOUT = 400;

  private takenPortSet = new Set<number>();

  getPort = async () => {
    let port = this.getRandomPort();

    while (this.takenPortSet.has(port)) {
      port = this.getRandomPort();
    }

    this.takenPortSet.add(port);

    return port;
  };

  releasePort = (port: number) => this.takenPortSet.delete(port);

  private getRandomPort = () =>
    Math.floor(
      Math.random() * (this.MAX_PORT - this.MIN_PORT + 1) + this.MIN_PORT,
    );
}
