/** Browser telemetry always forwards to the OML production API. */
export function rumIngestionUrl() {
    return "https://api.oneminutelogs.com/api/v2/rum/batches";
}
