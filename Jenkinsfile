
pipeline {
    agent { label 'AGENT-1' }

    environment {
        AWS_ACCOUNT_ID = '193849563622'
        AWS_REGION     = 'us-east-1'
        ECR_REPO_NAME  = 'enterprise-pipeline'

        GITHUB_ORG      = 'vikasarisela'
        GITHUB_REPO     = 'enterprise-pipeline'

        GITHUB_TOKEN = credentials('github-token')
        SONAR_TOKEN  = credentials('sonar-token')
    }

    stages {

        stage('1. Fetch Source Code') {
            steps {
                checkout scm
            }
        }

        stage('Test GitHub Authentication') {
    steps {
        sh '''
            curl -s \
              -H "Authorization: token $GITHUB_TOKEN" \
              -H "Accept: application/vnd.github+json" \
              https://api.github.com/user
        '''
    }
}

        stage('2. Security Gate: Dependabot Check') {
            steps {
                script {
                    echo "Querying GitHub Security API for active dependency risks..."

                    def response = sh(
                        script: '''
                            curl -s \
                              -H "Authorization: token $GITHUB_TOKEN" \
                              -H "Accept: application/vnd.github+json" \
                              "https://api.github.com/repos/$GITHUB_ORG/$GITHUB_REPO/dependabot/alerts"
                        ''',
                        returnStdout: true
                    ).trim()

                    echo "GitHub API response received."

                    def alertCount = sh(
                        script: """
                            echo '${response}' | jq '
                                if type == "array" then
                                    [
                                        .[] |
                                        select(
                                            .state == "open" and
                                            (
                                                .security_advisory.severity == "critical" or
                                                .security_advisory.severity == "high"
                                            )
                                        )
                                    ] | length
                                else
                                    error("GitHub API did not return a valid alert array")
                                end
                            '
                        """,
                        returnStdout: true
                    ).trim().toInteger()

                    echo "Open High/Critical Dependabot alerts: ${alertCount}"

                    if (alertCount > 0) {
                        error "PIPELINE ABORTED: Security Gate Failed! Dependabot found ${alertCount} unresolved high/critical risks."
                    }

                    echo "Dependabot Check Passed: 0 open critical/high flaws."
                }
            }
        }

        stage('3. Quality Gate 1: Run Unit Tests') {
            steps {
                sh 'npm install'
                sh 'npm test'
            }
        }

        stage('4. Quality Gate 2: SonarQube Static Analysis') {
            steps {
                withSonarQubeEnv('MySonarQubeServer') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.token="$SONAR_TOKEN"
                    '''
                }
            }
        }

        stage('5. Verification: Await SonarQube Callback') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        def qg = waitForQualityGate()

                        if (qg.status != 'OK') {
                            error "PIPELINE ABORTED: SonarQube Quality Gate Defeated. Status: ${qg.status}"
                        }

                        echo "SonarQube Quality Gate Verified: OK."
                    }
                }
            }
        }

        stage('6. Package: Compile Container Image') {
            steps {
                echo "Packaging application into Docker container..."

                sh """
                    docker build \
                      -t ${ECR_REPO_NAME}:${BUILD_NUMBER} .
                """

                sh """
                    docker tag \
                      ${ECR_REPO_NAME}:${BUILD_NUMBER} \
                      ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:${BUILD_NUMBER}
                """

                sh """
                    docker tag \
                      ${ECR_REPO_NAME}:${BUILD_NUMBER} \
                      ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:latest
                """
            }
        }

        stage('7. Ship: Push Image to AWS ECR') {
            steps {
                script {
                    echo "Authenticating Docker with AWS ECR..."

                    sh '''
                        aws ecr get-login-password \
                          --region "$AWS_REGION" |
                        docker login \
                          --username AWS \
                          --password-stdin \
                          "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
                    '''

                    echo "Pushing image to AWS ECR..."

                    sh """
                        docker push \
                          ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:${BUILD_NUMBER}
                    """

                    sh """
                        docker push \
                          ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:latest
                    """
                }
            }
        }
    }

    post {
        always {
            echo "Cleaning temporary Docker image from worker node..."

            sh """
                docker rmi -f ${ECR_REPO_NAME}:${BUILD_NUMBER} || true
                docker rmi -f ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:${BUILD_NUMBER} || true
                docker rmi -f ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:latest || true
            """
        }

        success {
            echo "Success! Image passed all quality/security gates and was uploaded to AWS ECR."
        }
    }
}

