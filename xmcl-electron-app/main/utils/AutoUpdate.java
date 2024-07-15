import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;
import java.io.IOException;
import java.lang.InterruptedException;
import java.lang.Thread;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
// import scanner
import java.util.Scanner;

public class AutoUpdate {
  static void sleep(int ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
  }

  public static void main(String[] args) {
    // First argument is old version path
    // Second argument is new version path
    // Third argument is the path to the executable
    Path pendingPath = Paths.get(args[0]);
    Path appAsarPath = Paths.get(args[1]);
    Path logFile = Paths.get("update.log");

    logFile = logFile.toAbsolutePath();

    // try 3 times
    for (int i = 0; i < 3; i++) {
      try {
        sleep(1000);
        // Copy with replace existing
        Files.copy(pendingPath, appAsarPath, StandardCopyOption.REPLACE_EXISTING);
        // Delete old version
        Files.delete(pendingPath);
        break;
      } catch (IOException e) {
        e.printStackTrace();
        // Write to log
        try {
          Files.write(logFile, e.getMessage().getBytes(), StandardOpenOption.APPEND, StandardOpenOption.CREATE);
        } catch (IOException ee) {
          ee.printStackTrace();
        }
      }
    }

    // Start the new version
    try {
      Runtime.getRuntime().exec('"' + args[2] + '"');
    } catch (IOException e) {
      e.printStackTrace();
      // Write to log
      try {
        Files.write(logFile, e.getMessage().getBytes(), StandardOpenOption.APPEND, StandardOpenOption.CREATE);
      } catch (IOException ee) {
        ee.printStackTrace();
      }
    }
  }
}
