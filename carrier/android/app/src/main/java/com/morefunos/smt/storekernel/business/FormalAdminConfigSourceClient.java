package com.morefunos.smt.storekernel.business;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.function.Supplier;

/**
 * Performs one explicit native read of the canonical Admin active envelope.
 * Scheduling and WebSocket doorbells stay outside this class; it is not a polling engine.
 */
public final class FormalAdminConfigSourceClient {
    public static final int MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;
    public static final int CONNECT_TIMEOUT_MS = 5_000;
    public static final int READ_TIMEOUT_MS = 10_000;

    public interface Transport {
        CompletableFuture<HttpResponse> get(URI uri);
    }

    interface EnvelopeSink {
        CompletableFuture<FormalAdminConfigProducer.ApplyResult> apply(String body, String observedAt);
    }

    public static final class HttpResponse {
        public final int status;
        public final String body;

        public HttpResponse(int status, String body) {
            this.status = status;
            this.body = body;
        }
    }

    public static final class FetchResult {
        public final boolean activePresent;
        public final long sourceRevision;
        public final String sourceFingerprint;
        public final long aggregateRevision;
        public final boolean replayed;

        private FetchResult(
            boolean activePresent,
            long sourceRevision,
            String sourceFingerprint,
            long aggregateRevision,
            boolean replayed
        ) {
            this.activePresent = activePresent;
            this.sourceRevision = sourceRevision;
            this.sourceFingerprint = sourceFingerprint;
            this.aggregateRevision = aggregateRevision;
            this.replayed = replayed;
        }

        static FetchResult missing() {
            return new FetchResult(false, 0, null, 0, false);
        }

        static FetchResult applied(FormalAdminConfigProducer.ApplyResult result) {
            return new FetchResult(
                true,
                result.sourceRevision,
                result.sourceFingerprint,
                result.aggregateRevision,
                result.replayed
            );
        }
    }

    private final URI activeUri;
    private final Transport transport;
    private final EnvelopeSink sink;
    private final Supplier<Instant> clock;

    public FormalAdminConfigSourceClient(
        URI sourceOrigin,
        String storeId,
        Transport transport,
        FormalAdminConfigProducer producer,
        Supplier<Instant> clock
    ) {
        this(sourceOrigin, storeId, transport, sink(producer), clock);
    }

    FormalAdminConfigSourceClient(
        URI sourceOrigin,
        String storeId,
        Transport transport,
        EnvelopeSink sink,
        Supplier<Instant> clock
    ) {
        this.activeUri = activeUri(sourceOrigin, identifier(storeId));
        this.transport = Objects.requireNonNull(transport, "ADMIN_CONFIG_SOURCE_TRANSPORT_REQUIRED");
        this.sink = Objects.requireNonNull(sink, "ADMIN_CONFIG_SOURCE_SINK_REQUIRED");
        this.clock = Objects.requireNonNull(clock, "ADMIN_CONFIG_SOURCE_CLOCK_REQUIRED");
    }

    public CompletableFuture<FetchResult> fetchActive() {
        final CompletableFuture<HttpResponse> responseFuture;
        try {
            responseFuture = transport.get(activeUri);
        } catch (Throwable error) {
            return failed(error);
        }
        if (responseFuture == null) {
            return failed("ADMIN_CONFIG_SOURCE_TRANSPORT_INVALID");
        }
        return responseFuture.thenCompose(response -> {
            if (response == null) return failed("ADMIN_CONFIG_SOURCE_RESPONSE_INVALID");
            if (response.status == HttpURLConnection.HTTP_NOT_FOUND) {
                return CompletableFuture.completedFuture(FetchResult.missing());
            }
            if (response.status != HttpURLConnection.HTTP_OK) {
                return failed("ADMIN_CONFIG_SOURCE_HTTP_" + response.status);
            }
            if (response.body == null) return failed("ADMIN_CONFIG_SOURCE_BODY_INVALID");
            if (response.body.getBytes(StandardCharsets.UTF_8).length > MAX_ENVELOPE_BYTES) {
                return failed("ADMIN_CONFIG_SOURCE_BODY_TOO_LARGE");
            }
            final Instant observedAt;
            try {
                observedAt = clock.get();
            } catch (Throwable error) {
                return failed(error);
            }
            if (observedAt == null) return failed("ADMIN_CONFIG_SOURCE_CLOCK_INVALID");
            final CompletableFuture<FormalAdminConfigProducer.ApplyResult> applied;
            try {
                applied = sink.apply(response.body, observedAt.toString());
            } catch (Throwable error) {
                return failed(error);
            }
            if (applied == null) return failed("ADMIN_CONFIG_SOURCE_SINK_INVALID");
            return applied.thenApply(FetchResult::applied);
        });
    }

    private static URI activeUri(URI origin, String storeId) {
        if (origin == null || !"https".equalsIgnoreCase(origin.getScheme())) {
            throw new IllegalArgumentException("ADMIN_CONFIG_SOURCE_HTTPS_REQUIRED");
        }
        final String path = origin.getPath();
        if (origin.isOpaque()
            || origin.getHost() == null
            || origin.getHost().isEmpty()
            || origin.getRawUserInfo() != null
            || origin.getRawQuery() != null
            || origin.getRawFragment() != null
            || (path != null && !path.isEmpty() && !"/".equals(path))) {
            throw new IllegalArgumentException("ADMIN_CONFIG_SOURCE_ORIGIN_INVALID");
        }
        final StringBuilder value = new StringBuilder("https://").append(origin.getRawAuthority());
        value.append("/api/admin-sync/active?storeId=")
            .append(urlEncode(storeId));
        return URI.create(value.toString());
    }

    private static String urlEncode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20");
        } catch (UnsupportedEncodingException impossible) {
            throw new IllegalStateException("ADMIN_CONFIG_SOURCE_UTF8_UNAVAILABLE", impossible);
        }
    }

    private static String identifier(String value) {
        if (value == null || value.isEmpty() || !value.equals(value.trim()) || value.length() > 64) {
            throw new IllegalArgumentException("ADMIN_CONFIG_SOURCE_STORE_ID_INVALID");
        }
        for (int index = 0; index < value.length(); index++) {
            if (Character.isISOControl(value.charAt(index))) {
                throw new IllegalArgumentException("ADMIN_CONFIG_SOURCE_STORE_ID_INVALID");
            }
        }
        return value;
    }

    private static EnvelopeSink sink(FormalAdminConfigProducer producer) {
        Objects.requireNonNull(producer, "ADMIN_CONFIG_PRODUCER_REQUIRED");
        return producer::apply;
    }

    private static <T> CompletableFuture<T> failed(String code) {
        return failed(new IllegalStateException(code));
    }

    private static <T> CompletableFuture<T> failed(Throwable error) {
        final CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    /** HTTPS transport with redirects disabled, bounded reads, and no ambient credentials. */
    public static final class UrlConnectionTransport implements Transport {
        private final Executor executor;

        public UrlConnectionTransport(Executor executor) {
            this.executor = Objects.requireNonNull(executor, "ADMIN_CONFIG_SOURCE_EXECUTOR_REQUIRED");
        }

        @Override
        public CompletableFuture<HttpResponse> get(URI uri) {
            return CompletableFuture.supplyAsync(() -> {
                try {
                    return execute(uri);
                } catch (IOException error) {
                    throw new CompletionException(error);
                }
            }, executor);
        }

        private static HttpResponse execute(URI uri) throws IOException {
            if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IOException("ADMIN_CONFIG_SOURCE_HTTPS_REQUIRED");
            }
            final HttpURLConnection connection = (HttpURLConnection) uri.toURL().openConnection();
            try {
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setInstanceFollowRedirects(false);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Cache-Control", "no-cache");
                final int status = connection.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) return new HttpResponse(status, "");
                final long declaredLength = connection.getContentLengthLong();
                if (declaredLength > MAX_ENVELOPE_BYTES) {
                    throw new IOException("ADMIN_CONFIG_SOURCE_BODY_TOO_LARGE");
                }
                try (InputStream input = connection.getInputStream()) {
                    return new HttpResponse(status, readUtf8Bounded(input));
                }
            } finally {
                connection.disconnect();
            }
        }

        static String readUtf8Bounded(InputStream input) throws IOException {
            final ByteArrayOutputStream output = new ByteArrayOutputStream();
            final byte[] buffer = new byte[8_192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_ENVELOPE_BYTES) throw new IOException("ADMIN_CONFIG_SOURCE_BODY_TOO_LARGE");
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
