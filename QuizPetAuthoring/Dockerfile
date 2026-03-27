FROM quizpet-tomcat-python:9.0-jdk8

# Copy python_parser.py to the path expected by the Java application
COPY python_src/python_parser.py /opt/quizpet/python_parser.py
RUN chmod +x /opt/quizpet/python_parser.py

COPY target/quizpet-1.0.0-BUILD-SNAPSHOT.war /usr/local/tomcat/webapps/quizpet.war