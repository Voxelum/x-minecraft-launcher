import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;

public final class MultiJarLauncher {
    public static void main(String[] payloads) throws Exception {
        for (String payload : payloads) {
            launch(payload);
        }
    }

    private static void launch(String payload) throws Exception {
        String decoded = new String(Base64.getDecoder().decode(payload), StandardCharsets.UTF_8);
        String[] fields = decoded.split("\u0000", -1);
        if (fields.length < 2) {
            throw new IllegalArgumentException("Invalid processor payload");
        }

        String mainClass = fields[0];
        int classpathCount = Integer.parseInt(fields[1]);
        if (classpathCount < 1 || fields.length < 2 + classpathCount) {
            throw new IllegalArgumentException("Invalid processor classpath");
        }

        URL[] urls = new URL[classpathCount];
        for (int i = 0; i < classpathCount; i++) {
            urls[i] = new File(fields[2 + i]).toURI().toURL();
        }
        String[] args = Arrays.copyOfRange(fields, 2 + classpathCount, fields.length);

        Thread thread = Thread.currentThread();
        ClassLoader previous = thread.getContextClassLoader();
        ClassLoader parent = ClassLoader.getSystemClassLoader().getParent();
        try (URLClassLoader loader = new URLClassLoader(urls, parent)) {
            thread.setContextClassLoader(loader);
            Class<?> entrypoint = Class.forName(mainClass, true, loader);
            Method main = entrypoint.getMethod("main", String[].class);
            try {
                main.invoke(null, (Object) args);
            } catch (InvocationTargetException error) {
                Throwable cause = error.getCause();
                if (cause instanceof Exception) throw (Exception) cause;
                if (cause instanceof Error) throw (Error) cause;
                throw error;
            }
        } finally {
            thread.setContextClassLoader(previous);
        }
    }
}