FROM quizpet-tomcat-python:9.0-jdk8

# 把项目里的 python_parser.py 拷到 Java 期望的路径
COPY python_src/python_parser.py /opt/quizpet/python_parser.py
RUN chmod +x /opt/quizpet/python_parser.py

COPY target/quizpet-1.0.0-BUILD-SNAPSHOT.war /usr/local/tomcat/webapps/quizpet.war