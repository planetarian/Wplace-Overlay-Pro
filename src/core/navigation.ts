const EXPLORE_URI = "https://backend.wplace.live/s0/tile/random";
const originalJson = Response.prototype.json;

let forceLocation: any;

export function setDestinationLocation(location: any) {
    forceLocation = location;
}

export function setResponseIntercept() {
    Response.prototype.json = async function (this: Response): Promise<any> {
        if (!this.url || this.url.length === 0) {
            return originalJson.call(this);
        }
        if (!!forceLocation && this.url === EXPLORE_URI) {
            const location = {
                pixel: {
                    x: forceLocation.posX,
                    y: forceLocation.posY
                },
                tile: {
                    x: forceLocation.chunk1,
                    y: forceLocation.chunk2
                }
            };
            forceLocation = null;
            return location;
        }

        return originalJson.call(this);
    }
}